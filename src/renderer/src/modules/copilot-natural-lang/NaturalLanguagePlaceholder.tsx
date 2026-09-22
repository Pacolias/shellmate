import es from '@shared/i18n/es.json';
import { ComingSoon } from '../../components/ComingSoon';

export function NaturalLanguagePlaceholder() {
  return <ComingSoon title={es.copilot.naturalLanguage.title} description={es.copilot.naturalLanguage.comingSoon} />;
}
