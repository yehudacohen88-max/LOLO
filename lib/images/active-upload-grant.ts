/** Header carrying the short-lived create-event upload grant. Not a secret. */
export const UPLOAD_GRANT_HEADER = "x-lolo-upload-token";

let activeUploadGrant = "";

export function setActiveUploadGrant(token: string) {
  activeUploadGrant = token;
}

export function readActiveUploadGrant() {
  return activeUploadGrant;
}
