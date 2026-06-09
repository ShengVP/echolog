// Markdown 渲染组件 —— 复用 react-markdown + 我们的 .markdown-body 样式
// 关键点：把 ![](assets/xxx.jpg) 改写成 IPC 拿到的 data URL，否则 Electron sandbox 拦截 file://
import { useEffect, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface Props {
  content: string;
  // 当渲染某天的 raw_logs / diary 时传入，让相对路径 assets/xxx.jpg 解析为 <date>/assets/xxx.jpg
  dateContext?: string;
}

// 把 ![](assets/xxx) → ![](echolog-asset:<dateContext>/assets/xxx)，让我们的 img 替换器接管
function rewriteAssetPaths(content: string, dateContext?: string): string {
  if (!dateContext) return content;
  return content.replace(
    /!\[([^\]]*)\]\(assets\/([^)]+)\)/g,
    (_match, alt, file) => `![${alt}](echolog-asset:${dateContext}/assets/${file})`,
  );
}

export function Markdown({ content, dateContext }: Props) {
  const rewritten = useMemo(() => rewriteAssetPaths(content, dateContext), [content, dateContext]);

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          img: ({ src, alt }) => <AssetImage src={src || ''} alt={alt || ''} />,
        }}
      >
        {rewritten}
      </ReactMarkdown>
    </div>
  );
}

function AssetImage({ src, alt }: { src: string; alt: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src.startsWith('echolog-asset:')) {
      setDataUrl(src);
      return;
    }
    const relPath = src.slice('echolog-asset:'.length);
    window.api.readAssetDataUrl(relPath)
      .then(url => {
        if (url) setDataUrl(url);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [src]);

  if (failed) {
    return (
      <span className="inline-flex items-center gap-2 px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-500">
        🖼 {alt || '（找不到资源）'}
      </span>
    );
  }
  if (!dataUrl) {
    return (
      <span className="inline-flex items-center gap-2 px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-500">
        ⏳ 加载中 {alt || ''}
      </span>
    );
  }
  return <img src={dataUrl} alt={alt} className="max-w-full rounded-lg my-3" />;
}
