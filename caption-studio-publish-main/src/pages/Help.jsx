import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'
import { Mail, MessageCircle, FileText, ExternalLink } from 'lucide-react'

export default function Help() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-[#111111]">
      <nav className="sticky top-0 z-50 bg-[#0d0d0d]/90 backdrop-blur-md border-b border-white/5 h-14 flex items-center justify-between px-6">
        <Link to={createPageUrl('Home')} className="hover:opacity-80 transition-opacity">
          <CaptionStudioLogo size="default" showText={true} />
        </Link>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <Link to={createPageUrl('Faq')} className="text-sm text-gray-400 hover:text-white transition-colors">FAQ</Link>
          <Link to={createPageUrl('Help')} className="text-sm text-white font-medium">Help</Link>
          <Link to={createPageUrl('Terms')} className="text-sm text-gray-400 hover:text-white transition-colors">Terms</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 md:py-16">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Help & Support</h1>
        <p className="text-gray-500 mb-12">We're here to help. Reach out through any of the channels below.</p>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
          {[
            { icon: FileText, title: 'Browse FAQ', desc: 'Quick answers to common questions', href: createPageUrl('Faq') },
            { icon: Mail, title: 'Email Us', desc: 'support@lekhacaptions.com', href: 'mailto:support@lekhacaptions.com' },
            { icon: MessageCircle, title: 'Community', desc: 'Join our Discord for tips & help', href: '#' },
          ].map(({ icon: Icon, title, desc, href }) => (
            <a
              key={title}
              href={href}
              className="flex flex-col gap-2 p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all group"
            >
              <Icon className="w-5 h-5 text-[#F5A623]" />
              <span className="text-sm font-medium text-white group-hover:text-[#F5A623] transition-colors">{title}</span>
              <span className="text-xs text-gray-500">{desc}</span>
            </a>
          ))}
        </div>

        {/* Contact form */}
        <div className="border border-white/10 rounded-2xl p-5 md:p-8 bg-white/[0.02]">
          <h2 className="text-lg font-semibold text-white mb-6">Send us a message</h2>
          {submitted ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-white font-medium mb-1">Message sent!</p>
              <p className="text-sm text-gray-500">We'll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Name</label>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#F5A623]/50"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Email</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#F5A623]/50"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Subject</label>
                <input
                  required
                  type="text"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-base text-white placeholder-gray-600 focus:outline-none focus:border-[#F5A623]/50"
                  placeholder="What's your issue about?"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Message</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#F5A623]/50 resize-none"
                  placeholder="Describe your issue in detail..."
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-white hover:bg-gray-100 text-black font-semibold rounded-lg text-sm transition-colors"
              >
                Send Message
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
