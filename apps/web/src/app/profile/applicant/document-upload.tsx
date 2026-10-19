'use client';
import { useActionState } from 'react';
import { Alert, Button, ScrollIntoView } from '@/components/ui';
import { uploadApplicantDocument, type UploadState } from '@/lib/apply/actions';

export function DocumentUpload() {
  const [state, formAction, pending] = useActionState<UploadState, FormData>(uploadApplicantDocument, {});
  return (
    <form action={formAction} className="grid gap-3">
      <label htmlFor="document-file" className="text-sm font-medium text-ink">
        Choose a file
      </label>
      <input
        id="document-file"
        name="file"
        type="file"
        required
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        aria-describedby="document-file-hint"
        className="text-sm text-ink file:mr-3 file:h-10 file:rounded-full file:border file:border-line file:bg-surface file:px-4 file:text-sm file:font-medium file:text-ink"
      />
      <p id="document-file-hint" className="text-sm text-ink-2">
        PDF, PNG or JPG, 5 MB or smaller.
      </p>
      {!pending && state.uploaded && (
        <ScrollIntoView>
          <Alert tone="good" title="Uploaded">
            Your file is stored encrypted.
          </Alert>
        </ScrollIntoView>
      )}
      {!pending && state.error && (
        <ScrollIntoView>
          <Alert tone="bad">{state.error}</Alert>
        </ScrollIntoView>
      )}
      <div>
        <Button type="submit" variant="secondary" loading={pending}>
          Upload document
        </Button>
      </div>
    </form>
  );
}
