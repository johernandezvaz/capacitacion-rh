"use client";

import { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { PenLine, Trash2 } from 'lucide-react';

interface OjtSignatureCanvasProps {
  currentUrl: string | null;
  instanceId: string;
  fieldKey: string;
  onSave: (url: string) => void;
  disabled?: boolean;
}

export function OjtSignatureCanvas({ currentUrl, instanceId, fieldKey, onSave, disabled }: OjtSignatureCanvasProps) {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const getCtx = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return ctx;
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#192b52';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  useEffect(() => {
    if (open) setTimeout(initCanvas, 50);
  }, [open]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = getCtx(); if (!ctx) return;
    isDrawing.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const ctx = getCtx(); if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => { isDrawing.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current; if (!canvas) return;
    setIsUploading(true);
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No se pudo generar la imagen');

      const timestamp = Date.now();
      const path = `${instanceId}/${fieldKey}_${timestamp}.png`;

      const { error: upErr } = await supabase.storage
        .from('signatures')
        .upload(path, blob, { contentType: 'image/png', upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(path);
      onSave(urlData.publicUrl);
      setOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error al guardar firma');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className="flex flex-col items-center justify-center w-full min-h-[48px] border border-dashed border-border rounded hover:border-[#2166be] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={currentUrl ? 'Cambiar firma' : 'Agregar firma'}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="Firma" className="max-h-[44px] max-w-[110px] object-contain" />
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground py-2">
            <PenLine className="w-3.5 h-3.5" />
            Firma
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Capturar Firma</DialogTitle>
          </DialogHeader>

          <div className="border border-border rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={220}
              className="w-full h-[220px] touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>

          <div className="flex justify-between pt-1">
            <Button type="button" variant="outline" size="sm" onClick={clearCanvas} className="gap-2 text-muted-foreground">
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isUploading}
                className="bg-[#2166be] hover:bg-[#1a5299] text-white"
              >
                {isUploading ? 'Guardando...' : 'Guardar firma'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
