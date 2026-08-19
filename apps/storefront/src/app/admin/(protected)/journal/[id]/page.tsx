import { notFound } from "next/navigation";
import { JournalArticleEditor } from "@/components/admin/JournalArticleEditor";
import { PageHeader } from "@/components/admin/ui/primitives";
import { getJournalArticle, listJournalCategories } from "@/lib/admin/journal";
import { shopToday } from "@/lib/dates";

export const metadata = { title: "Επεξεργασία άρθρου" };

type Params = Promise<{ id: string }>;

export default async function AdminJournalArticlePage({ params }: { params: Params }) {
  const { id } = await params;
  // A malformed id (not a uuid) makes Postgres throw rather than return no
  // rows, which would surface as a 500 on a plain typo in the URL. Treated as
  // "no such article", because that is what it is.
  const article = await getJournalArticle(id).catch(() => null);
  if (!article) notFound();

  const categories = await listJournalCategories();

  return (
    <>
      <PageHeader
        title={article.title}
        description={`/journal/${article.slug}`}
        breadcrumb={[{ label: "Journal", href: "/admin/journal" }, { label: "Επεξεργασία" }]}
      />
      <JournalArticleEditor article={article} categories={categories} today={shopToday()} />
    </>
  );
}
