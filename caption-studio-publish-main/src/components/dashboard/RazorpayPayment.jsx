
import { toast } from '@/components/ui/use-toast'

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export const initiateRazorpayPayment = async ({
  amount,
  planName,
  planId,
  keyId,
  userEmail,
  userName,
  onSuccess,
  onFailure
}) => {
  const res = await loadRazorpayScript()

  if (!res) {
    toast({
      variant: 'destructive',
      title: 'Razorpay SDK failed to load',
      description: 'Please check your internet connection.',
    })
    return
  }

  if (!keyId) {
    toast({
      variant: 'destructive',
      title: 'Payment configuration error',
      description: 'Please contact support.',
    })
    return
  }

  const options = {
    key: keyId,
    amount: amount, // Amount in paise
    currency: 'INR',
    name: 'Caption Studio',
    description: `${planName} Subscription`,
    image: '/logo.png',
    handler: function (response) {
      // Payment successful
      onSuccess({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature,
        planId
      })
    },
    prefill: {
      name: userName || '',
      email: userEmail || '',
    },
    notes: {
      plan_id: planId,
      plan_name: planName
    },
    theme: {
      color: '#9333ea'
    },
    modal: {
      ondismiss: function() {
        if (onFailure) {
          onFailure('Payment cancelled by user')
        }
      }
    }
  }

  const paymentObject = new window.Razorpay(options)
  
  // Add small delay to ensure proper initialization
  setTimeout(() => {
    paymentObject.open()
  }, 100)
}

export default function RazorpayPayment() {
  return null
}
