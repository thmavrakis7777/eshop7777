import { NewJournalArticleForm } from "@/components/admin/NewJournalArticleForm";
import { PageHeader } from "@/components/admin/ui/primitives";

export const metadata = { title: "Νέο άρθρο" };

export default function NewJournalArticlePage() {
  return (
    <>
      <PageHeader
        title="Νέο άρθρο"
        description="Τίτλος και διεύθυνση — το υπόλοιπο γράφεται στη συνέχεια."
        breadcrumb={[{ label: "Journal", href: "/admin/journal" }, { label: "Νέο" }]}
      />
      <div className="max-w-xl">
        <NewJournalArticleForm />
      </div>
    </>
  );
}
