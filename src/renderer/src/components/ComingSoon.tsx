import styles from './ComingSoon.module.css';

export interface ComingSoonProps {
  title: string;
  description: string;
}

/** Elegant placeholder for a panel whose functionality lands in a later phase. */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <section className={styles.panel} aria-label={title}>
      <h2 className={styles.heading}>{title}</h2>
      <div className={styles.body}>
        <span className={styles.glyph} aria-hidden="true" />
        <p className={styles.description}>{description}</p>
      </div>
    </section>
  );
}
