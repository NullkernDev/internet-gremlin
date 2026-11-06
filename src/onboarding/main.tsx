import { createRoot } from 'react-dom/client';
import '../ui/ui.css';
import './onboarding.css';
import { Onboarding } from './Onboarding';

createRoot(document.getElementById('root')!).render(<Onboarding />);
