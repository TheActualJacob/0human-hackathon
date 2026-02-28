import twilio from 'twilio'

function getClient() {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim()
  const authToken = (process.env.TWILIO_AUTH_TOKEN ?? '').trim()
  return twilio(accountSid, authToken)
}

function getFromNumber() {
  return (process.env.TWILIO_WHATSAPP_NUMBER ?? '').trim()
}

export async function sendWhatsAppMessage(toNumber: string, body: string): Promise<string> {
  const to = toNumber.startsWith('whatsapp:') ? toNumber : `whatsapp:${toNumber}`

  const message = await getClient().messages.create({
    from: getFromNumber(),
    to,
    body,
  })

  return message.sid
}

export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = (process.env.TWILIO_AUTH_TOKEN ?? '').trim()
  return twilio.validateRequest(authToken, signature, url, params)
}
