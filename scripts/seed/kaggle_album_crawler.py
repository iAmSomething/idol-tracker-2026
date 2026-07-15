import requests
from bs4 import BeautifulSoup
import time
import json
import re

class UltimateBugsAlbumCrawler:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        self.session = requests.Session()
        self.start_date = "2026-07-10"
        self.end_date = "2026-12-31"

    def fetch_album_details(self, album_url: str, release_date: str) -> dict:
        print(f"Scraping album details: {album_url}")
        
        album_data = {
            "title": "",
            "artistName": "",
            "releaseType": "",
            "releaseDate": release_date,
            "agency": "",
            "imageUrl": "",
            "tracks": [],
            "musicVideoUrl": ""
        }
        
        try:
            resp = self.session.get(album_url, headers=self.headers, timeout=5)
            if resp.status_code != 200:
                return None
                
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # 1. Cover Image & Title
            img_tag = soup.select_one(".basicInfo .photos img")
            if img_tag and img_tag.has_attr("src"):
                album_data["imageUrl"] = img_tag["src"].split("?")[0]
                alt_text = img_tag.get("alt", "")
                album_data["title"] = alt_text.replace(" 사진", "")

            # 2. Basic Info
            info_table = soup.select(".basicInfo .info tbody tr")
            if info_table:
                for tr in info_table:
                    th = tr.select_one("th")
                    td = tr.select_one("td")
                    if not th or not td: continue
                    
                    label = th.text.strip()
                    if label == "아티스트":
                        artist_a = td.select_one("a")
                        album_data["artistName"] = artist_a.text.strip() if artist_a else td.text.strip()
                    elif label == "유형":
                        album_data["releaseType"] = td.text.strip()
                    elif label == "기획사":
                        album_data["agency"] = td.text.strip()

            # 3. Track List
            track_table = soup.select("table.list.trackList.byAlbum tr")
            for tr in track_table:
                track_id = tr.get("trackid") or tr.get("trackId")
                mvid = tr.get("mvid") or tr.get("mvId")
                if not track_id:
                    continue
                
                index_em = tr.select_one("td p.trackIndex em")
                track_number = int(index_em.text.strip()) if index_em else 0
                
                title_badge = tr.select_one("td p.trackIndex span.albumTitle")
                is_title = True if title_badge and "[타이틀곡]" in title_badge.text else False
                
                title_a = tr.select_one("th p.title a")
                track_title = title_a.text.strip() if title_a else ""
                
                artist_a = tr.select_one("td.left p.artist a")
                track_artist = artist_a.text.strip() if artist_a else album_data["artistName"]
                
                track_info = {
                    "trackNumber": track_number,
                    "title": track_title,
                    "artist": track_artist,
                    "isTitle": is_title,
                    "streamingLinks": {}
                }
                
                if track_id:
                    track_info["streamingLinks"]["bugs"] = f"https://music.bugs.co.kr/track/{track_id}"
                
                album_data["tracks"].append(track_info)
                
                if not album_data["musicVideoUrl"] and mvid and mvid != "0":
                    album_data["musicVideoUrl"] = f"https://music.bugs.co.kr/mv/{mvid}"

        except Exception as e:
            print(f"Error parsing album {album_url}: {e}")
            
        return album_data

    def run_full_scan(self, max_pages=50):
        print("🚀 아이돌 최신 앨범 목록 스캔 시작...")
        dataset = []
        
        for page in range(1, max_pages + 1):
            url = f"https://music.bugs.co.kr/genre/kpop/idol/total?tabtype=3&sort=default&nation=all&page={page}"
            
            try:
                resp = self.session.get(url, headers=self.headers, timeout=5)
                if resp.status_code != 200: break
                soup = BeautifulSoup(resp.text, 'html.parser')
                album_items = soup.select("figure.albumInfo")
                
                if not album_items: break
                oldest_date_on_page = "9999-12-31" 
                
                for item in album_items:
                    title_elem = item.select_one(".albumTitle a")
                    artist_elem = item.select_one(".artist a")
                    time_elem = item.select_one("time")
                    type_elem = item.select_one(".albumType") 
                    
                    if title_elem and artist_elem and time_elem:
                        album_url = title_elem.get('href', '')
                        artist_name = artist_elem.text.strip()
                        album_type = type_elem.text.strip() if type_elem else ""
                        
                        release_date = time_elem.text.strip().replace(".", "-")
                        
                        if release_date < oldest_date_on_page:
                            oldest_date_on_page = release_date

                        # 필터링: Various Artists나 OST는 제외
                        if "Various" in artist_name or "OST" in album_type.upper(): continue
                            
                        # 날짜 필터링: 1월 ~ 7월 사이만
                        if self.start_date <= release_date <= self.end_date:
                            print(f"  [발견] {artist_name} - 발매일: {release_date}")
                            # 앨범 상세 정보 딥다이브
                            album_details = self.fetch_album_details(album_url, release_date)
                            if album_details:
                                dataset.append(album_details)
                            time.sleep(0.5)

                print(f"✔️ {page}페이지 완료 (누적 {len(dataset)}개 앨범)")
                
                if oldest_date_on_page < self.start_date:
                    print(f"🛑 {oldest_date_on_page} 발매작 도달. 과거 탐색 종료.")
                    break
                time.sleep(1) 
            except Exception as e:
                print(f"⚠️ {page}페이지 네트워크 에러: {e}")
                continue
                
        return dataset

if __name__ == "__main__":
    crawler = UltimateBugsAlbumCrawler()
    
    # 최근 2페이지만 스캔 (빠른 보강을 위해)
    dataset = crawler.run_full_scan(max_pages=10)
    
    output_file = "bugs_comeback_data.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
        
    print(f"\n✨ 수집 끝! 총 {len(dataset)}개의 앨범(컴백) 마스터 데이터가 {output_file}에 저장되었습니다.")
