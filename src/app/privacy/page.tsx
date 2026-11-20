import type { Metadata } from "next"
import { LegalPage, LegalSection } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy · Kate's Game Night",
  description: "What Kate's Game Night stores, and what it does with it.",
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Kate&apos;s Game Night is a private, non-commercial booking site for a small group of friends.
        It is run by Kelvin Lau. Questions or deletion requests:{" "}
        <a className="underline underline-offset-2" href="mailto:kelvinctl07@gmail.com">
          kelvinctl07@gmail.com
        </a>
        .
      </p>
      <LegalSection title="What we collect">
        <ul className="list-disc pl-5">
          <li>
            Sign-in is with Google only. We store the name, email, and profile picture Google
            sends. We ask only for the basic profile, email, and openid scopes. We do not ask for
            or store a password.
          </li>
          <li>A guest booking stores the name you type, the date, and the number of seats taken.</li>
          <li>
            A wrong answer to the security question stores your IP address so we can slow down
            guessing. Records older than a day are deleted the next time someone gets the answer
            wrong.
          </li>
        </ul>
      </LegalSection>
      <LegalSection title="How we use it">
        <p>
          We use this only to run bookings and login. We do not sell it, share it, or show ads. We
          do not add analytics beyond the standard logs Vercel keeps for hosting. The site is hosted
          on Vercel. The database is Neon.
        </p>
      </LegalSection>
      <LegalSection title="Google user data">
        <p>
          Google user data is used only to sign you in. That use is consistent with the{" "}
          <a
            className="underline underline-offset-2"
            href="https://developers.google.com/terms/api-services-user-data-policy"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. We do not use Google data for advertising, and
          we do not sell it.
        </p>
      </LegalSection>
      <LegalSection title="Deletion">
        <p>
          Email{" "}
          <a className="underline underline-offset-2" href="mailto:kelvinctl07@gmail.com">
            kelvinctl07@gmail.com
          </a>{" "}
          to ask for your account or other data to be deleted. An admin can also remove a booking.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
