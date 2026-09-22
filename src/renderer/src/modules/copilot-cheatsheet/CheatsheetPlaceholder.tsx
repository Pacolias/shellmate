import es from '@shared/i18n/es.json';
import { ComingSoon } from '../../components/ComingSoon';

export function CheatsheetPlaceholder() {
  return <ComingSoon title={es.copilot.cheatsheet.title} description={es.copilot.cheatsheet.comingSoon} />;
}
