import type { Metadata } from "next"
import { LegalPage, LegalSection } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service · Kate's Game Night",
  description: "The casual terms for using Kate's Game Night.",
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        Kate&apos;s Game Night is a casual, private booking page for a small group of friends. It is
        not a business. It is run by Kelvin Lau. Contact:{" "}
        <a className="underline underline-offset-2" href="mailto:kelvinctl07@gmail.com">
          kelvinctl07@gmail.com
        </a>
        .
      </p>
      <LegalSection title="Be nice">
        <p>
          Join a night you actually want, use your own name, and don&apos;t try to break the site or
          guess your way past the security question.
        </p>
      </LegalSection>
      <LegalSection title="Admins">
        <p>Admins may remove a booking or an account.</p>
      </LegalSection>
      <LegalSection title="As-is">
        <p>
          The site is provided as-is. There is no warranty. It may be wrong, late, or unavailable,
          and a booking here is just a note among friends.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
