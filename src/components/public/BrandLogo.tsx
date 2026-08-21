import Image from 'next/image';

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = '', priority = false }: BrandLogoProps) {
  return (
    <span className={`official-logo ${className}`.trim()}>
      <Image
        src="/assets/logos/logo-campus-innovate.png"
        alt=""
        width={500}
        height={500}
        priority={priority}
        sizes="56px"
      />
      <span className="brand-wordmark"><strong>Campus<br />Innovate</strong><small>Building Systems. Developing Leaders.</small></span>
    </span>
  );
}
