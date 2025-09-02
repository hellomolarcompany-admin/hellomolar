import Image from 'next/image';

export default function HeaderImage() {
  return (
    <Image
      src="/brand/header.svg"
      alt="Klinika Dental header"
      width={1000}
      height={200}
      priority
      sizes="(max-width: 1000px) 100vw, 1000px"
      className="h-auto w-auto max-w-full"
    />
  );
}
