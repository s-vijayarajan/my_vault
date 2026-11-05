import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import './styles.css';
import { VaultProvider } from './vault';
import { AppShell } from './ui/App';

createRoot(document.getElementById('root')!).render(<VaultProvider><AppShell /></VaultProvider>);
