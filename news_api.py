import requests

def fetch_news(coin):
    url = (
        "https://cryptopanic.com/api/v1/posts/"
        "?auth_token=4f6e331497bf63c57e0b7d36b0a2e410&public=true"
        f"&currencies={coin}"
    )

    try:
        response = requests.get(url)
        data = response.json()

        if "results" not in data:
            return []

        final_news = []
        for item in data["results"]:
            meta = item.get("metadata") or {}

            title = (
                item.get("title")
                or meta.get("title")
                or item.get("slug")
                or "Untitled"
            )

            final_news.append({
                "title": title,
                "url": item.get("url", "#"),
                "source": item.get("source", {}).get("title", "Unknown"),
                "published": item.get("published_at", ""),
                "description": meta.get("description", "")
            })

        return final_news

    except Exception as e:
        print("NEWS ERROR:", e)
        return []
