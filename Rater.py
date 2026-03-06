import requests
from bs4 import BeautifulSoup
import json
import sys
import os

OMDB_API_KEYS = [
    "1a118f7c", "e4ac93ca", "6055a849", "a26c954",
    "d3c7a27e", "172b5c2d", "9f5d4cea", "c0e0387b", "50e5247a", "fd47297e"
]
KEY_STATE_FILE = os.path.join(os.path.dirname(__file__), ".omdb_key_index")

def get_next_api_key():
    index = 0
    if os.path.exists(KEY_STATE_FILE):
        try:
            with open(KEY_STATE_FILE, "r") as f:
                index = int(f.read().strip())
        except Exception:
            index = 0
    
    key = OMDB_API_KEYS[index % len(OMDB_API_KEYS)]
    
    # Save next index
    try:
        with open(KEY_STATE_FILE, "w") as f:
            f.write(str((index + 1) % len(OMDB_API_KEYS)))
    except Exception:
        pass
        
    return key

# --- 1. THE TRANSLATOR ---
def get_urls_from_wikidata(imdb_id):
    query = f"""
    SELECT ?rt_id ?mc_id WHERE {{
      ?item wdt:P345 "{imdb_id}".
      OPTIONAL {{ ?item wdt:P1258 ?rt_id. }}
      OPTIONAL {{ ?item wdt:P1712 ?mc_id. }}
    }} LIMIT 1
    """
    url = "https://query.wikidata.org/sparql"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Python Scraper', 'Accept': 'application/json'}
    
    urls: dict = {'rt_url': None, 'mc_url': None}
    try:
        response = requests.get(url, params={'query': query}, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', {}).get('bindings', [])
            if results:
                row = results[0]
                if 'rt_id' in row:
                    rt_slug = row['rt_id']['value']
                    if not rt_slug.startswith('m/') and not rt_slug.startswith('tv/'):
                        rt_slug = f"m/{rt_slug}"
                    urls['rt_url'] = f"https://www.rottentomatoes.com/{rt_slug}"
                if 'mc_id' in row:
                    mc_slug = row['mc_id']['value']
                    urls['mc_url'] = f"https://www.metacritic.com/{mc_slug}"
    except Exception:
        pass
    return urls


# --- 2. OFFICIAL SITE SCRAPERS ---
def get_headers():
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
    }

def scrape_omdb(imdb_id):
    """Gets IMDb rating and Metascore via OMDB API with key rotation."""
    all_limited = True
    for _ in range(len(OMDB_API_KEYS)):
        api_key = get_next_api_key()
        url = f"https://www.omdbapi.com/?i={imdb_id}&apikey={api_key}"
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('Response') == 'True':
                    imdb_val = data.get('imdbRating', 'N/A')
                    ms_val = data.get('Metascore', 'N/A')
                    return imdb_val, ms_val
                elif "limit" in data.get('Error', '').lower():
                    continue
                else:
                    all_limited = False
                    break
        except Exception:
            continue
            
    if all_limited:
        return "LIMIT", "LIMIT"
    return "N/A", "N/A"

def scrape_rotten_tomatoes(rt_url):
    if not rt_url: return "N/A", "N/A"
    try:
        response = requests.get(rt_url, headers=get_headers(), timeout=5)
        if response.status_code != 200: return "N/A", "N/A"

        soup = BeautifulSoup(response.text, 'html.parser')
        
        scorecard = soup.find('media-scorecard')
        if scorecard:
            c_tag = scorecard.find('rt-text', attrs={'slot': 'critics-score'})
            a_tag = scorecard.find('rt-text', attrs={'slot': 'audience-score'})
            return (c_tag.text.strip() if c_tag else "N/A"), (a_tag.text.strip() if a_tag else "N/A")
            
        old_board = soup.find('score-board') or soup.find('score-board-deprecated')
        if old_board:
            c = old_board.get('criticscore', 'N/A')
            a = old_board.get('audiencescore', 'N/A')
            return (f"{c}%" if c != "N/A" else "N/A"), (f"{a}%" if a != "N/A" else "N/A")
            
    except Exception:
        pass
    return "N/A", "N/A"

def scrape_metacritic(mc_url):
    """Scrapes Metacritic for the Metascore (0-100), falls back to User Score * 10."""
    if not mc_url: return "N/A"
    try:
        response = requests.get(mc_url, headers=get_headers(), timeout=10)
        if response.status_code != 200: return "N/A"

        soup = BeautifulSoup(response.text, 'html.parser')

        # 1st try: JSON-LD aggregateRating (Metascore, already 0-100)
        import json as _json
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = _json.loads(script.string)
                if isinstance(data, dict) and 'aggregateRating' in data:
                    val = data['aggregateRating'].get('ratingValue')
                    if val is not None and float(val) > 0:
                        return str(int(float(val)))
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and 'aggregateRating' in item:
                            val = item['aggregateRating'].get('ratingValue')
                            if val is not None and float(val) > 0:
                                return str(int(float(val)))
            except Exception:
                continue

        # 2nd try: First User Score element (title="User score X.X out of 10"), multiply by 10
        for score_div in soup.find_all('div', class_='c-siteReviewScore'):
            title_attr = score_div.get('title', '')
            if 'User score' in title_attr and 'out of 10' in title_attr:
                score_text = score_div.text.strip()
                if score_text and score_text != 'tbd':
                    user_val = float(score_text) * 10
                    if user_val > 0:
                        return str(int(user_val))
                break  # Only check the first user score

    except Exception:
        pass
    return "N/A"


# --- 3. MAIN EXECUTION & MATH ---
def calculate_ultimate_score(imdb_score, mc_score, rt_critics, rt_audience):
    """Calculates the ultimate score based on available ratings."""
    try:
        def safe_float(val):
            if not val or val == "N/A": return None
            try:
                # Handle % and / formats
                clean_val = str(val).split('/')[0].replace('%', '').strip()
                return float(clean_val)
            except (ValueError, IndexError):
                return None

        i_val = safe_float(imdb_score)
        m_val = safe_float(mc_score)
        rc_val = safe_float(rt_critics)
        ra_val = safe_float(rt_audience)
        
        imdb_10 = None
        score_sum = 0
        weight_sum = 0

        if i_val is not None:
            imdb_10 = i_val * 10 if (0 < i_val < 11) else i_val
            score_sum += imdb_10 * 0.40
            weight_sum += 0.40

        if m_val is not None and m_val > 0:
            score_sum += m_val * 0.40
            weight_sum += 0.40

        rt_scores = []
        if rc_val is not None and rc_val > 0: rt_scores.append(rc_val)
        if ra_val is not None and ra_val > 0: rt_scores.append(ra_val)
        
        if rt_scores:
            rt_avg = sum(rt_scores) / len(rt_scores)
            score_sum += rt_avg * 0.20
            weight_sum += 0.20

        if weight_sum == 0:
            return None, ["All Sources"], None

        ultimate_score = score_sum / weight_sum

        return ultimate_score, {
            'imdb_10': float(f"{imdb_10:.1f}") if imdb_10 is not None else None,
            'm_val': float(f"{m_val:.1f}") if m_val is not None else None,
            'rc_val': float(f"{rc_val:.1f}") if rc_val is not None else None,
            'ra_val': float(f"{ra_val:.1f}") if ra_val is not None else None
        }, None
        
    except Exception as e:
        return None, None, str(e)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        imdb_id = sys.argv[1].strip()
        forced_key = None
        entry_type = "movie"  # default

        # Parse remaining args: could be [api_key] [--type movie|series]
        i = 2
        while i < len(sys.argv):
            arg = sys.argv[i].strip()
            if arg == "--type" and i + 1 < len(sys.argv):
                entry_type = sys.argv[i + 1].strip().lower()
                i += 2
            elif not forced_key:
                forced_key = arg
                i += 1
            else:
                i += 1

        urls = get_urls_from_wikidata(imdb_id)
        mc_source = "omdb"  # Track where mc_score came from

        if forced_key:
            url = f"https://www.omdbapi.com/?i={imdb_id}&apikey={forced_key}"
            imdb_score, mc_score = "N/A", "N/A"
            try:
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if data.get('Response') == 'True':
                        imdb_score = data.get('imdbRating', 'N/A')
                        mc_score = data.get('Metascore', 'N/A')
            except Exception: pass
        else:
            imdb_score, mc_score = scrape_omdb(imdb_id)

        # For series: ALWAYS scrape Metacritic website (ignore OMDB Metascore)
        # For movies: use OMDB Metascore, fallback to website if unavailable
        if entry_type == "series":
            mc_score = "N/A"  # Force website scrape for series
            mc_source = "metacritic"

        if mc_score in (None, "N/A", "") and urls.get('mc_url'):
            scraped_mc = scrape_metacritic(urls['mc_url'])
            if scraped_mc != "N/A":
                mc_score = scraped_mc
                mc_source = "metacritic"
            else:
                mc_source = "none"

        rt_critics, rt_audience = scrape_rotten_tomatoes(urls['rt_url'])
        
        score, breakdown, error = calculate_ultimate_score(imdb_score, mc_score, rt_critics, rt_audience)
        
        if score is not None and isinstance(breakdown, dict):
            print(json.dumps({
                'ultimate_score': float(f"{score:.1f}"),
                'imdb_10': breakdown['imdb_10'],
                'm_val': breakdown['m_val'],
                'rc_val': breakdown['rc_val'],
                'ra_val': breakdown['ra_val'],
                'mc_source': mc_source
            }))
        else:
            if isinstance(breakdown, list):
                print(json.dumps({'error': f"LIMIT" if imdb_score == "LIMIT" else f"Missing data for: {', '.join(breakdown)}"}))
            else:
                print(json.dumps({'error': error or 'Unknown error'}))
    else:
        imdb_id = input("Enter IMDb ID: ").strip()
        if not imdb_id: sys.exit()
        urls = get_urls_from_wikidata(imdb_id)
        imdb_score, mc_score = scrape_omdb(imdb_id)
        # Metacritic fallback: if OMDB didn't return Metascore, scrape website
        if mc_score in (None, "N/A", "") and urls.get('mc_url'):
            mc_score = scrape_metacritic(urls['mc_url'])
        rt_critics, rt_audience = scrape_rotten_tomatoes(urls['rt_url'])
        score, breakdown, error = calculate_ultimate_score(imdb_score, mc_score, rt_critics, rt_audience)
        if score is not None and isinstance(breakdown, dict):
            print(f"\n- IMDB ID: {imdb_id}")
            print(f"- IMDB RATING*10: {breakdown['imdb_10']:.0f}")
            print(f"- Metacritic score: {breakdown['m_val']:.0f}")
            print(f"- RT critics: {breakdown['rc_val'] or 0:.0f}")
            print(f"- RT Audience: {breakdown['ra_val'] or 0:.0f}")
            print(f"- Ultimate Score: {score:.1f}")
        else:
            print(f"\nError: {error or 'Could not calculate'}")
