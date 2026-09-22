import es from '@shared/i18n/es.json';
import { ComingSoon } from '../../components/ComingSoon';

export function HistoryDiaryPlaceholder() {
  return <ComingSoon title={es.context.history.title} description={es.context.history.comingSoon} />;
}
