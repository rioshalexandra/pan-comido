import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { backupFile, backupInfo, restoreFile } from '../lib/localDb';
import { dateText } from '../lib/format';
import { Header } from '../components/ui';

const DAYS = 7;
const daysSince = (stamp) => (stamp ? Math.floor((Date.now() - new Date(`${stamp.replace(' ', 'T')}Z`).getTime()) / 86400000) : null);

// Aviso en Inicio cuando hace mucho que no guarda una copia
export function BackupReminder() {
  const { lastBackup, changedAt, hasData } = backupInfo();
  const days = daysSince(lastBackup);
  if (!hasData || (lastBackup && (days < DAYS || changedAt <= lastBackup))) return null;
  return (
    <Link to="/copia" className="card flex items-center gap-3 border-gold p-4">
      <span className="text-2xl">💾</span>
      <span>
        <span className="block font-bold">{lastBackup ? `Hace ${days} días que no guardás una copia` : 'Guardá una copia de tus datos'}</span>
        <span className="block text-sm text-cocoa-soft">Tus recetas están solo en este celular. Si lo perdés, con la copia las recuperás.</span>
      </span>
    </Link>
  );
}

export default function BackupPage() {
  const { setSettings } = useStore();
  const [info, setInfo] = useState(backupInfo);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function saveCopy() {
    setError('');
    const file = backupFile();
    setInfo(backupInfo());
    // En el celular abre "Compartir" (Drive, WhatsApp, mail...); si no se puede, la descarga
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Copia de Cuánto Cobro' });
        setNotice('¡Listo! Guardá ese archivo en un lugar seguro (Drive, tu mail o un chat de WhatsApp con vos misma).');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setNotice(`Se descargó "${file.name}". Guardalo en un lugar seguro (Drive, tu mail o un chat de WhatsApp con vos misma).`);
  }

  async function restore(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setNotice('');
    if (!confirm('Vas a reemplazar todo lo que hay en este celular por lo que tiene la copia. ¿Seguimos?')) return;
    try {
      setSettings(await restoreFile(file));
      setInfo(backupInfo());
      setNotice('¡Listo! Ya están tus datos de la copia.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Header title="Copia de seguridad" subtitle="Tus recetas, ingredientes y ajustes se guardan solo en este celular. Nadie más los ve." />

      <section className="card flex flex-col gap-3 p-4">
        <div className="section-title">Guardar copia</div>
        <p className="text-sm text-cocoa-soft">
          Hacela una vez por semana. Si perdés o cambiás el celular, con ese archivo recuperás todo.
          {info.lastBackup ? ` Última copia: ${dateText(info.lastBackup)}.` : ' Todavía no guardaste ninguna.'}
        </p>
        <button className="btn btn-primary" onClick={saveCopy}>
          💾 Guardar copia
        </button>
      </section>

      <section className="card flex flex-col gap-3 p-4">
        <div className="section-title">Recuperar copia</div>
        <p className="text-sm text-cocoa-soft">En el celular nuevo, entrá con tu usuario y elegí el archivo de la copia.</p>
        <label className="btn">
          📂 Elegir archivo de copia
          <input type="file" accept=".json,application/json" className="hidden" onChange={restore} />
        </label>
      </section>

      <p className="text-sm text-cocoa-soft">
        Consejo: agregá la app a la pantalla de inicio del celular. Así el teléfono no borra tus datos para hacer lugar.
      </p>

      {notice && <div className="card bg-gold-soft/60 p-3 text-sm font-semibold">{notice}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
