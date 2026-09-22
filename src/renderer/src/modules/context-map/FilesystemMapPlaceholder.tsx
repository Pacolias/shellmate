import es from '@shared/i18n/es.json';
import { ComingSoon } from '../../components/ComingSoon';

export function FilesystemMapPlaceholder() {
  return <ComingSoon title={es.context.map.title} description={es.context.map.comingSoon} />;
}
