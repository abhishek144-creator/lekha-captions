import Link from 'next/link'

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Lekha Captions home">
      <img src="/lekha-icon.svg" width="32" height="32" alt="" />
      <strong className="brand-name">Lekha Captions</strong>
    </Link>
  )
}
