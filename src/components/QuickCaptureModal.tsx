import { useState } from 'react';
import { Camera, Trash2, Check } from 'lucide-react';
import { Modal, Button } from './ui';

export function QuickCaptureModal({ open, onClose, onDone }: {
  open: boolean;
  onClose: () => void;
  onDone: (files: File[]) => void;
}) {
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);

  function addPhoto(file: File) {
    setPhotos((p) => [...p, { file, url: URL.createObjectURL(file) }]);
  }

  function removePhoto(i: number) {
    setPhotos((p) => {
      URL.revokeObjectURL(p[i].url);
      return p.filter((_, j) => j !== i);
    });
  }

  function done() {
    if (photos.length === 0) { onClose(); return; }
    onDone(photos.map((p) => p.file));
    setPhotos([]);
  }

  function cancel() {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    onClose();
  }

  return (
    <Modal
      open={open} onClose={cancel} title="Quick Capture Receipts"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
          <Button onClick={done} disabled={photos.length === 0}>
            <Check size={16} /> Done{photos.length > 0 ? ` (${photos.length})` : ''}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Snap as many handwritten receipts as you like, one after another. When you tap <span className="font-semibold">Done</span>, each one opens as a New Order — AI fills in the fields, you review and save, then the next one opens automatically.
        </p>

        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-800 py-8 cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-950/50 transition">
          <Camera size={28} className="text-sky-600" />
          <span className="text-sm font-semibold text-sky-700 dark:text-sky-300">
            {photos.length === 0 ? 'Take a photo' : 'Take another photo'}
          </span>
          <input
            type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) addPhoto(e.target.files[0]); e.target.value = ''; }}
          />
        </label>

        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square group">
                <img src={p.url} alt={`Receipt ${i + 1}`} className="w-full h-full object-cover" />
                <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold rounded px-1.5 py-0.5">{i + 1}</span>
                <button
                  onClick={() => removePhoto(i)}
                  title="Remove"
                  className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600 text-white rounded-full p-1 transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
