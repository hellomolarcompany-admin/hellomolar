import Image from 'next/image';

interface Props {
  size?: number; // px
  withWordmark?: boolean;
}

export default function Logo({ size = 28, withWordmark = false }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Image src="/brand/tooth.svg" width={size} height={size} alt="Logo" priority />
      {withWordmark ? <span className="heading-title text-lg">HelloMolar</span> : null}
    </div>
  );
}
