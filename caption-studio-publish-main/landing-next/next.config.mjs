const requiredProductionEnv = [
  'NEXT_PUBLIC_LEGAL_BUSINESS_NAME',
  'NEXT_PUBLIC_LEGAL_BUSINESS_ADDRESS',
  'NEXT_PUBLIC_GOVERNING_VENUE',
  'NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME',
  'NEXT_PUBLIC_GRIEVANCE_EMAIL',
]

if (process.env.NODE_ENV === 'production') {
  const missing = requiredProductionEnv.filter((key) => !String(process.env[key] || '').trim())
  if (missing.length) {
    throw new Error(`Marketing production build requires legal identity fields: ${missing.join(', ')}`)
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
}

export default nextConfig
