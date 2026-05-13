import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

/**
 * Send a magic-link invitation email to an existing Supabase user.
 * Falls back to a no-op (with a warning) if RESEND_API_KEY is not set.
 */
export async function sendInvitationEmail(params: {
  to: string
  companyName: string
  magicLink: string
  fromName?: string
}) {
  const { to, companyName, magicLink, fromName = 'Waariko' } = params

  if (!resend) {
    // Dev mode without Resend: just log the link so the admin can share it manually
    console.warn(
      '[sendInvitationEmail] RESEND_API_KEY not set — magic link for',
      to,
      '→',
      magicLink,
    )
    return
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'noreply@waariko.com'

  const { error } = await resend.emails.send({
    from: `${fromName} <${fromAddress}>`,
    to,
    subject: `Invitation à rejoindre ${companyName} sur Waariko`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#2e4d6c">Vous avez été invité à rejoindre ${companyName}</h2>
        <p>Cliquez sur le bouton ci-dessous pour accepter l'invitation et accéder à votre espace :</p>
        <a href="${magicLink}"
           style="display:inline-block;padding:12px 24px;background:#c09544;color:#fff;
                  border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
          Accepter l'invitation
        </a>
        <p style="color:#888;font-size:12px">Ce lien est valable 7 jours.</p>
      </div>
    `,
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
}
