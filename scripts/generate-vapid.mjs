import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()
console.log('Añade esto a Vercel (Environment Variables) y a .env.local para vercel dev:\n')
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
