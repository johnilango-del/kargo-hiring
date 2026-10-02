import UploadClient from './UploadClient';

export const metadata = { title: 'Upload CVs · Kargo Hiring' };

export default function UploadPage() {
  return (
    <>
      <h1>Upload CVs</h1>
      <p className="muted">
        Choose the role, then select one or more PDF CVs. Files are processed one at a time.
        Nothing is emailed — you review every candidate on the dashboard first.
      </p>
      <UploadClient />
    </>
  );
}
