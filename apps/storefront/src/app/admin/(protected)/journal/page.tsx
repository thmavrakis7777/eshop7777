import { JournalArticleList } from "@/components/admin/JournalArticleList";
import { ButtonLink, EmptyState, PageHeader } from "@/components/admin/ui/primitives";
import { listJournalArticles } from "@/lib/admin/journal";
import { shopToday } from "@/lib/dates";

export const metadata = { title: "Journal" };

export default async function AdminJournalPage() {
  const articles = await listJournalArticles();
  const published = articles.filter((a) => a.status === "published").length;

  return (
    <>
      <PageHeader
        title="Journal"
        description={
          articles.length === 0
            ? "Άρθρα, οδηγοί και ιδέες για το σπίτι — το περιεχόμενο που φέρνει επισκέπτες από το Google."
            : `${articles.length} άρθρα, ${published} δημοσιευμένα.`
        }
        action={
          <>
            <ButtonLink href="/admin/journal/categories">Κατηγορίες</ButtonLink>
            <ButtonLink href="/admin/journal/new" variant="primary">
              Νέο άρθρο
            </ButtonLink>
          </>
        }
      />

      {articles.length === 0 ? (
        <EmptyState
          title="Κανένα άρθρο ακόμα"
          description="Το Journal είναι ο χώρος για οδηγούς αγοράς, ιδέες οργάνωσης και πρακτικές συμβουλές. Κάθε άρθρο αποκτά τη δική του διεύθυνση, μπαίνει στο sitemap και μπορεί να συνδέεται με προϊόντα."
          action={
            <ButtonLink href="/admin/journal/new" variant="primary">
              Γράψε το πρώτο άρθρο
            </ButtonLink>
          }
        />
      ) : (
        <JournalArticleList articles={articles} today={shopToday()} />
      )}
    </>
  );
}
