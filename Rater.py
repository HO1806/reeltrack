import requests
from bs4 import BeautifulSoup
import json
import sys

OMDB_API_KEY = "e4ac93ca"

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
        response = requests.get(url, params={'query': query}, headers=headers, timeout=15)
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
    """Gets IMDb rating and Metascore via OMDB API."""
    url = f"https://www.omdbapi.com/?i={imdb_id}&apikey={OMDB_API_KEY}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('Response') == 'True':
                imdb_val = data.get('imdbRating', 'N/A')
                ms_val = data.get('Metascore', 'N/A')
                return imdb_val, ms_val
    except Exception:
        pass
    return "N/A", "N/A"

def scrape_rotten_tomatoes(rt_url):
    if not rt_url: return "N/A", "N/A"
    try:
        response = requests.get(rt_url, headers=get_headers(), timeout=15)
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


# --- 3. MAIN EXECUTION & MATH ---
def calculate_ultimate_score(imdb_score, mc_score, rt_critics, rt_audience):
    """Calculates the ultimate score based on available ratings."""
    try:
        def safe_float(val):
            if not val or val == "N/A": return None
            try:
                clean_val = val.split('/')[0].replace('%', '').strip()
                return float(clean_val)
            except (ValueError, IndexError):
                return None

        i_val = safe_float(imdb_score)
        m_val = safe_float(mc_score)
        rc_val = safe_float(rt_critics)
        ra_val = safe_float(rt_audience)
        
        # Base variables
        imdb_10 = None
        rt_avg = None
        
        score_sum = 0
        weight_sum = 0

        # Process IMDB (40% weight)
        if i_val is not None:
            imdb_10 = i_val * 10
            score_sum += imdb_10 * 0.40
            weight_sum += 0.40

        # Process Metacritic (40% weight)
        if m_val is not None:
            score_sum += m_val * 0.40
            weight_sum += 0.40

        # Process Rotten Tomatoes (20% weight)
        rt_scores: list[float] = []
        if rc_val is not None: rt_scores.append(rc_val)
        if ra_val is not None: rt_scores.append(ra_val)
        
        if rt_scores:
            rt_avg = sum(rt_scores) / len(rt_scores)
            score_sum += rt_avg * 0.20
            weight_sum += 0.20

        # Calculate final proportional score
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
    # When called from Node.js backend: python Rater.py <imdb_id>
    # Output is always JSON for machine parsing
    if len(sys.argv) > 1:
        imdb_id = sys.argv[1].strip()
        
        urls = get_urls_from_wikidata(imdb_id)
        imdb_score, mc_score = scrape_omdb(imdb_id)
        rt_critics, rt_audience = scrape_rotten_tomatoes(urls['rt_url'])
        
        score, breakdown, error = calculate_ultimate_score(imdb_score, mc_score, rt_critics, rt_audience)
        
        if score is not None and isinstance(breakdown, dict):
            print(json.dumps({
                'ultimate_score': float(f"{score:.1f}"),
                'imdb_10': breakdown['imdb_10'],
                'm_val': breakdown['m_val'],
                'rc_val': breakdown['rc_val'],
                'ra_val': breakdown['ra_val']
            }))
        else:
            if isinstance(breakdown, list):
                print(json.dumps({'error': f"Missing data for: {', '.join(breakdown)}"}))
            else:
                print(json.dumps({'error': error or 'Unknown error'}))
    else:
        # Interactive mode for manual use
        imdb_id = input("Enter IMDb ID: ").strip()
        if not imdb_id:
            sys.exit()
            
        urls = get_urls_from_wikidata(imdb_id)
        
        print(f"Scraping OMDB ({imdb_id})...")
        imdb_score, mc_score = scrape_omdb(imdb_id)
        print(f"Scraping Rotten Tomatoes...")
        rt_critics, rt_audience = scrape_rotten_tomatoes(urls['rt_url'])
        
        score, breakdown, error = calculate_ultimate_score(imdb_score, mc_score, rt_critics, rt_audience)
        
        if score is not None and isinstance(breakdown, dict):
            print(f"\n- IMDB ID: {imdb_id}")
            print(f"- IMDB RATING*10: {breakdown['imdb_10']:.0f}")
            print(f"- Metacritic score: {breakdown['m_val']:.0f}")
            print(f"- RT critics: {breakdown['rc_val']:.0f}")
            print(f"- RT Audience: {breakdown['ra_val']:.0f}")
            print(f"- Ultimate Score: {score:.1f}")
        else:
            if isinstance(breakdown, list):
                print(f"\nError: Could not calculate. Missing data for: {', '.join(breakdown)}")
            else:
                print(f"\nCritical Error: {error}")
            print(f"Raw -> OMDB IMDb: {imdb_score} | OMDB Metascore: {mc_score} | RT: {rt_critics}/{rt_audience}")
