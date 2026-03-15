from sarvamai import SarvamAI
import sys
with open('sarvam_help.txt', 'w', encoding='utf-8') as f:
    sys.stdout = f
    help(SarvamAI)
