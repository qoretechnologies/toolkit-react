import { IAttachmentUpload } from './meta';

/**
 * Read a picked `File` into the inline base64 upload shape the support API expects
 * (the SaaS plane accepts attachments as base64 on the create/reply payload, with
 * no separate multipart upload). Shared by every composer so the customer and
 * staff surfaces encode files identically.
 */
export const fileToAttachment = (file: File): Promise<IAttachmentUpload> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      // reader.result is a data URL: "data:<type>;base64,<content>"
      const result = String(reader.result);
      const content = result.slice(result.indexOf(',') + 1);
      resolve({
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
        content,
      });
    };
    reader.readAsDataURL(file);
  });
