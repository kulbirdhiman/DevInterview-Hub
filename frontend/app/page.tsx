import LandingNav from '@/components/landing/LandingNav'
import Hero from '@/components/landing/Hero'
import WhyUs from '@/components/landing/WhyUs'
import Features from '@/components/landing/Features'
import HowItWorks from '@/components/landing/HowItWorks'
import FinalCta from '@/components/landing/FinalCta'
import Footer from '@/components/landing/Footer'

export default function HomePage() {
  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        <WhyUs />
        <Features />
        <HowItWorks />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
