"""Build the public shift bulletin from publishers' RSS feeds."""
import concurrent.futures
import datetime as dt
import email.utils
import json
import pathlib
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as xml

SOURCES = (
    ("kz", "TENGRINEWS", "https://tengrinews.kz/news.rss", "tengrinews.kz", 4),
    ("world", "EURONEWS", "https://ru.euronews.com/rss?level=theme&name=news", "euronews.com", 2),
)
NOW = dt.datetime.now(dt.timezone.utc)


def read_feed(source):
    region, name, url, domain, limit = source
    request = urllib.request.Request(url, headers={"User-Agent": "TairPortfolioNews/3.0"})
    with urllib.request.urlopen(request, timeout=15) as response:
        body = response.read(2_000_001)
    if len(body) > 2_000_000:
        raise ValueError("RSS exceeds the maximum size")
    items = []
    seen = set()
    for entry in xml.fromstring(body).findall("./channel/item"):
        title = " ".join((entry.findtext("title") or "").split())
        href = (entry.findtext("link") or "").strip()
        link = urllib.parse.urlsplit(href)
        if link.scheme != "https" or (link.hostname != domain and not (link.hostname or "").endswith("." + domain)):
            continue
        if region == "kz" and link.path.startswith(("/world_news/", "/world/")):
            continue
        try:
            date = email.utils.parsedate_to_datetime(entry.findtext("pubDate") or "")
            if not date.tzinfo or not NOW - dt.timedelta(days=3) <= date <= NOW + dt.timedelta(minutes=10):
                continue
        except (TypeError, ValueError, OverflowError):
            continue
        if not title or href in seen:
            continue
        seen.add(href)
        items.append({
            "title": title[:180],
            "href": href,
            "category": ("КАЗАХСТАН" if region == "kz" else "МИР") + " · " + name,
            "source": name,
            "region": region,
            "publishedAt": date.astimezone(dt.timezone.utc).isoformat(),
        })
    return sorted(items, key=lambda item: item["publishedAt"], reverse=True)[:limit]


def main(output):
    issues = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(SOURCES)) as pool:
        futures = [pool.submit(read_feed, source) for source in SOURCES]
        for source, task in zip(SOURCES, futures):
            try:
                issues.append(task.result())
            except (OSError, ValueError, xml.ParseError) as error:
                print(f"{source[1]}: {error}", file=sys.stderr)
                issues.append([])
    local, world = issues
    if not local:
        raise SystemExit("Kazakhstan feed is empty; keeping the previous issue")
    items = local + world[: min(2, len(local) // 2)]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "checkedAt": NOW.isoformat(),
        "items": items,
        "live": True,
        "partial": not world,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(items)} headlines")


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
