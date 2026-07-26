import { useCountry } from './useCountry';
import styles from './Logo.module.css';

export default function Logo() {
  const countryCode = useCountry();

  return (
    <div className={styles.logoWrapper}>
      <span className={styles.logoText}>ZixPlayer</span>
      {countryCode && (
        <span className={styles.countryBadge}>{countryCode}</span>
      )}
    </div>
  );
}