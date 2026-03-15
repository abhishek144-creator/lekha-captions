import requests
import re

def test_fetch():
    headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; U; Android 4.1.1; en-gb; Build/KLP) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Safari/534.30'
    }
    url = 'https://fonts.googleapis.com/css?family=Abril+Fatface'
    r = requests.get(url, headers=headers)
    print("Status:", r.status_code)
    print("Text:", r.text[:200])
    urls = re.findall(r'url\((.*?\.ttf)\)', r.text)
    print("TTF URLs:", urls)

if __name__ == '__main__':
    test_fetch()
