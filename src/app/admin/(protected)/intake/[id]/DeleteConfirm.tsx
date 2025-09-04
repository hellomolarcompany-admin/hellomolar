'use client';

import { useRef, useState } from 'react';

import CsrfField from '@/components/CsrfField';

export default function DeleteConfirm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const onConfirm = () => {
    setSubmitting(true);
    // Submit the POST form to the existing delete route; it redirects to the list.
    formRef.current?.submit();
  };

  return (
    <>
      <button
        type="button"
        className="rounded border border-red-400 px-3 py-1 text-red-700"
        onClick={() => setOpen(true)}
      >
        Delete
      </button>

      {/* hidden form used to perform the actual delete with CSRF */}
      <form ref={formRef} method="POST" action={`/admin/intake/${id}/delete`} className="hidden">
        <CsrfField />
      </form>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-md bg-white p-4 shadow"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-medium">Are you sure?</h2>
            <p className="mb-4 text-sm">Are you sure you want to delete this entry?</p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-1"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                No
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-60"
                onClick={onConfirm}
                disabled={submitting}
              >
                {submitting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
