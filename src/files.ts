import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** Save a file: browser download, or Android share sheet (lets the user save to Drive/Files/WhatsApp). */
export async function saveFile(name: string, data: string, mime: string, base64 = false): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const r = await Filesystem.writeFile(base64 ? { path: name, data, directory: Directory.Cache } : { path: name, data, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, url: r.uri, dialogTitle: 'Save or share ' + name }); return;
  }
  const blob = base64 ? new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: mime }) : new Blob([data], { type: mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export const readTextFile = (f: File) => f.text();
