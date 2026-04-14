use std::collections::HashMap;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{Duration, Utc};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::{
  io::{AsyncReadExt, AsyncWriteExt},
  net::TcpListener,
  time::{timeout, Duration as TokioDuration},
};
use url::Url;

const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL: &str = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_CLIENT_ID_PLACEHOLDER: &str = "GOOGLE_OAUTH_CLIENT_ID_PLACEHOLDER";
const GOOGLE_SCOPES: [&str; 6] = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

#[derive(Deserialize)]
struct GoogleTokenResponse {
  access_token: String,
  expires_in: i64,
  refresh_token: Option<String>,
  scope: String,
}

#[derive(Deserialize)]
struct GoogleUserInfo {
  id: String,
  email: String,
  name: String,
  picture: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleOAuthSession {
  provider: &'static str,
  user_id: String,
  email: String,
  display_name: String,
  avatar_url: Option<String>,
  access_token: String,
  refresh_token: String,
  expires_at: String,
  scopes: Vec<String>,
}

fn oauth_client_id() -> String {
  std::env::var("GOOGLE_OAUTH_CLIENT_ID").unwrap_or_else(|_| GOOGLE_CLIENT_ID_PLACEHOLDER.to_string())
}

fn random_url_safe(bytes: usize) -> String {
  let mut buffer = vec![0_u8; bytes];
  OsRng.fill_bytes(&mut buffer);
  URL_SAFE_NO_PAD.encode(buffer)
}

fn pkce_challenge(verifier: &str) -> String {
  let digest = Sha256::digest(verifier.as_bytes());
  URL_SAFE_NO_PAD.encode(digest)
}

fn parse_callback_request(request: &str) -> Result<HashMap<String, String>, String> {
  let request_line = request
    .lines()
    .next()
    .ok_or_else(|| "Missing OAuth callback request line.".to_string())?;
  let path = request_line
    .split_whitespace()
    .nth(1)
    .ok_or_else(|| "Missing OAuth callback path.".to_string())?;
  let url = Url::parse(&format!("http://127.0.0.1{path}")).map_err(|error| error.to_string())?;

  Ok(url.query_pairs().into_owned().collect())
}

async fn read_authorization_code(state: &str, challenge: &str) -> Result<(String, String), String> {
  let listener = TcpListener::bind("127.0.0.1:0")
    .await
    .map_err(|error| error.to_string())?;
  let redirect_uri = format!(
    "http://127.0.0.1:{}/callback",
    listener.local_addr().map_err(|error| error.to_string())?.port()
  );

  let auth_url = Url::parse_with_params(
    GOOGLE_AUTH_URL,
    &[
      ("client_id", oauth_client_id()),
      ("redirect_uri", redirect_uri.clone()),
      ("response_type", "code".to_string()),
      ("scope", GOOGLE_SCOPES.join(" ")),
      ("state", state.to_string()),
      ("code_challenge", challenge.to_string()),
      ("code_challenge_method", "S256".to_string()),
      ("access_type", "offline".to_string()),
      ("prompt", "consent".to_string()),
    ],
  )
  .map_err(|error| error.to_string())?;

  webbrowser::open(auth_url.as_str()).map_err(|error| error.to_string())?;

  let (mut stream, _) = timeout(TokioDuration::from_secs(180), listener.accept())
    .await
    .map_err(|_| "Timed out waiting for the Google OAuth callback.".to_string())?
    .map_err(|error| error.to_string())?;

  let mut buffer = [0_u8; 8192];
  let bytes_read = stream
    .read(&mut buffer)
    .await
    .map_err(|error| error.to_string())?;
  let request = String::from_utf8_lossy(&buffer[..bytes_read]);
  let params = parse_callback_request(&request)?;

  stream
    .write_all(
      b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h1>Tinker</h1><p>You can close this window and return to the app.</p></body></html>",
    )
    .await
    .map_err(|error| error.to_string())?;

  let returned_state = params
    .get("state")
    .ok_or_else(|| "Google OAuth callback did not include state.".to_string())?;
  if returned_state != state {
    return Err("Google OAuth callback state did not match the request.".to_string());
  }

  let code = params
    .get("code")
    .ok_or_else(|| "Google OAuth callback did not include a code.".to_string())?;

  Ok((code.clone(), redirect_uri))
}

#[tauri::command]
pub async fn oauth_flow() -> Result<GoogleOAuthSession, String> {
  let state = random_url_safe(24);
  let verifier = random_url_safe(48);
  let challenge = pkce_challenge(&verifier);
  let (code, redirect_uri) = read_authorization_code(&state, &challenge).await?;

  let token = reqwest::Client::new()
    .post(GOOGLE_TOKEN_URL)
    .form(&[
      ("client_id", oauth_client_id()),
      ("code", code),
      ("code_verifier", verifier),
      ("grant_type", "authorization_code".to_string()),
      ("redirect_uri", redirect_uri),
    ])
    .send()
    .await
    .map_err(|error| error.to_string())?
    .error_for_status()
    .map_err(|error| error.to_string())?
    .json::<GoogleTokenResponse>()
    .await
    .map_err(|error| error.to_string())?;

  let user = reqwest::Client::new()
    .get(GOOGLE_USERINFO_URL)
    .bearer_auth(&token.access_token)
    .send()
    .await
    .map_err(|error| error.to_string())?
    .error_for_status()
    .map_err(|error| error.to_string())?
    .json::<GoogleUserInfo>()
    .await
    .map_err(|error| error.to_string())?;

  Ok(GoogleOAuthSession {
    provider: "google",
    user_id: user.id,
    email: user.email,
    display_name: user.name,
    avatar_url: user.picture,
    access_token: token.access_token,
    refresh_token: token.refresh_token.unwrap_or_default(),
    expires_at: (Utc::now() + Duration::seconds(token.expires_in)).to_rfc3339(),
    scopes: token.scope.split_whitespace().map(ToString::to_string).collect(),
  })
}
