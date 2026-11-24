import { useEffect, useRef, useState } from "react";
import NineScoreLibrary from "../components/NineScoreLibrary";
import { DocumentResourceGrid, DocumentViewer } from "../components/DocumentResourceLibrary";
import { PageHeading, Segmented } from "../components/Common";
import { speakingResources } from "../data/static";
import { recordStudyActivity } from "../lib/localStudyStore";
import { scrollPageToTopAfterRender } from "../lib/pageScroll";

const tabs = [
  { value: "library", label: "资料库" },
  { value: "nine", label: "9 分达人" },
];

export default function Speaking({ intent }) {
  const [tab, setTab] = useState(intent?.tab || "library");
  const [resource, setResource] = useState(null);
  const returnScrollRef = useRef(0);

  const openResource = (item) => {
    if (!item) return;
    returnScrollRef.current = window.scrollY;
    setTab("library");
    setResource(item);
    scrollPageToTopAfterRender();
    recordStudyActivity({
      id: `speaking:${item.id}`,
      page: "speaking",
      subject: "口语",
      title: item.title,
      detail: `${item.type} / ${item.pages} 页`,
      intent: { tab: "library", resourceId: item.id },
    });
  };

  const closeResource = () => {
    setResource(null);
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: returnScrollRef.current, behavior: "auto" })));
  };

  useEffect(() => {
    if (intent?.tab) setTab(intent.tab);
    if (intent?.resourceId) openResource(speakingResources.find((item) => item.id === intent.resourceId));
    else setResource(null);
  }, [intent]);

  if (resource) return <DocumentViewer resource={resource} onClose={closeResource} />;

  return (
    <div className="page">
      <PageHeading
        eyebrow="Speaking"
        title={<>口语 <em>资料</em></>}
        description="口语表达资料与 9 分达人原书、解析及配套音频。"
      />
      <Segmented value={tab} onChange={setTab} options={tabs} label="口语资料分类" />
      <div className="tab-content">
        {tab === "library" && <DocumentResourceGrid resources={speakingResources} onOpen={openResource} />}
        {tab === "nine" && <NineScoreLibrary subject="speaking" initialFilePath={intent?.nineFilePath} />}
      </div>
    </div>
  );
}
