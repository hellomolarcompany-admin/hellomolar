import { DecryptCommand, KMSClient } from '@aws-sdk/client-kms';

const kmsClient = (() => {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region) return null;
  return new KMSClient({ region });
})();

export async function kmsDecryptBase64(b64Ciphertext: string): Promise<string> {
  if (!kmsClient) {
    // Dev fallback: allow plaintext prefixed values like "plain:..."
    if (b64Ciphertext.startsWith('plain:')) return b64Ciphertext.slice('plain:'.length);
    throw new Error('KMS is not configured');
  }
  const ciphertext = Buffer.from(b64Ciphertext, 'base64');
  const out = await kmsClient.send(new DecryptCommand({ CiphertextBlob: ciphertext }));
  if (!out.Plaintext) throw new Error('KMS decrypt returned no plaintext');
  return Buffer.from(out.Plaintext).toString('utf8');
}
