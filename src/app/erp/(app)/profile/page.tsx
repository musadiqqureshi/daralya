import { PageHeader } from "@/components/erp/page-header";
import { KeyValues, Section } from "@/components/erp/section";
import { requireSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await requireSession();
  const dict = await getDictionary();
  return (
    <>
      <PageHeader title={dict.erp.shell.profile} />
      <div className="grid grid-cols-1 max-w-4xl gap-6 md:grid-cols-2">
        <Section title={dict.common.details}>
          <KeyValues cols={1} items={[{ label: dict.common.name, value: session.profile.full_name }, { label: dict.common.email, value: session.email }, { label: dict.erp.fields.role, value: dict.roles[session.profile.role] }]} />
        </Section>
        <ProfileForm />
      </div>
    </>
  );
}
