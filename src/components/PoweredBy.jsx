const LOGO_URL = 'https://ftdfdozojlgvffomivrm.supabase.co/storage/v1/object/public/publico/logo-white.png';
const INSTAGRAM_URL = 'https://www.instagram.com/profesia.ia/';

export default function PoweredBy() {
  return (
    <a
      className="powered-by"
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Powered by ProfesIA"
    >
      <span>Powered by</span>
      <img src={LOGO_URL} alt="ProfesIA" />
    </a>
  );
}
