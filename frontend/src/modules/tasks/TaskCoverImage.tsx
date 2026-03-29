import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Image, Palette, X, Upload } from 'lucide-react';

interface TaskCoverImageProps {
  taskId: string;
  coverImageUrl?: string | null;
  coverImageColor?: string | null;
  onUpdate: () => void;
}

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#eab308', '#22c55e', '#14B8A6',
  '#3B82F6', '#8B5CF6', '#F97316', '#1C1C1F', '#111113',
];

export function TaskCoverImage({ taskId, coverImageUrl, coverImageColor, onUpdate }: TaskCoverImageProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('cover', file);
      const { data } = await api.post(`/tasks/${taskId}/cover-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      onUpdate();
      setShowMenu(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete(`/tasks/${taskId}/cover-image`);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      onUpdate();
      setShowMenu(false);
    },
  });

  const colorMutation = useMutation({
    mutationFn: async (color: string) => {
      const { data } = await api.patch(`/tasks/${taskId}/cover-color`, { color });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      onUpdate();
      setShowMenu(false);
    },
  });

  const hasCover = !!coverImageUrl || !!coverImageColor;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  return (
    <div className="relative">
      {/* Cover display */}
      {hasCover && (
        <div
          className="w-full h-32 rounded-t-lg overflow-hidden relative group"
          style={coverImageColor ? { backgroundColor: coverImageColor } : undefined}
        >
          {coverImageUrl && (
            <img
              src={coverImageUrl}
              alt="Task cover"
              className="w-full h-full object-cover"
            />
          )}
          <button
            onClick={() => setShowMenu((p) => !p)}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs"
          >
            Change Cover
          </button>
        </div>
      )}

      {/* Add Cover / Change Cover button when no cover */}
      {!hasCover && (
        <button
          onClick={() => setShowMenu((p) => !p)}
          className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary px-3 py-1.5 rounded-lg hover:bg-bg-hover transition-colors"
        >
          <Image size={14} />
          Add Cover
        </button>
      )}

      {/* Menu dropdown */}
      {showMenu && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 bg-bg-secondary border border-border-primary rounded-xl shadow-xl p-3 space-y-3">
          {/* Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 w-full text-sm text-text-primary hover:bg-bg-hover px-2 py-1.5 rounded-lg transition-colors"
          >
            <Upload size={14} />
            Upload Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Color picker */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary px-2 mb-2">
              <Palette size={12} />
              Solid Color
            </div>
            <div className="grid grid-cols-5 gap-1.5 px-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => colorMutation.mutate(color)}
                  className={cn(
                    'w-8 h-6 rounded-md border-2 transition-all hover:scale-110',
                    coverImageColor === color ? 'border-white' : 'border-transparent'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Remove */}
          {hasCover && (
            <button
              onClick={() => removeMutation.mutate()}
              className="flex items-center gap-2 w-full text-sm text-accent-red hover:bg-accent-red/10 px-2 py-1.5 rounded-lg transition-colors"
            >
              <X size={14} />
              Remove Cover
            </button>
          )}

          {/* Close */}
          <button
            onClick={() => setShowMenu(false)}
            className="w-full text-center text-xs text-text-tertiary hover:text-text-primary py-1"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
