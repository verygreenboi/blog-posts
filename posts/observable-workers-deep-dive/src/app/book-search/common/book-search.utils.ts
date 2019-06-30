import { asyncScheduler, from, Observable } from 'rxjs';
import { map, observeOn, scan, startWith } from 'rxjs/operators';
import {
  FuzzyMatchSimilarity,
  fuzzySubstringSimilarity,
} from './fuzzy-substring';

interface SearchMatch {
  paragraph: string;
  paragraphNumber: number;
  searchMatch: FuzzyMatchSimilarity;
}

function getSearchResults(
  searchTerm: string,
  paragraphs: string[],
): Observable<SearchMatch> {
  return from(paragraphs).pipe(
    observeOn(asyncScheduler),
    map((paragraph, index) => {
      const searchMatch = fuzzySubstringSimilarity(searchTerm, paragraph);
      return { searchMatch, paragraph, paragraphNumber: index };
    }),
  );
}

export interface MatchingParagraph {
  before: string;
  match: string;
  after: string;
  score: number;
}

export interface SearchResults {
  paragraphs: MatchingParagraph[];
  searchedParagraphCount: number;
  paragraphCount: number;
}

function accumulateResults(paragraphCount: number) {
  return (obs$: Observable<SearchMatch>): Observable<SearchResults> => {
    return obs$.pipe(
      scan((searchResults: SearchMatch[], searchResult: SearchMatch) => {
        searchResults.push(searchResult);
        return searchResults;
      }, []),
      startWith([]),
      map(
        (searchMatches: SearchMatch[]): SearchResults => {
          const last = searchMatches[searchMatches.length - 1];

          return {
            searchedParagraphCount: last ? last.paragraphNumber : 0,
            paragraphCount,
            paragraphs: searchMatches
              .sort(
                (a, b) =>
                  b.searchMatch.similarityScore - a.searchMatch.similarityScore,
              )
              .slice(0, 10)
              .map(({ searchMatch, paragraph }) => {
                return {
                  score: searchMatch.similarityScore,
                  match: paragraph.substring(
                    searchMatch.startIndex,
                    searchMatch.endIndex,
                  ),
                  before: paragraph.substring(0, searchMatch.startIndex),
                  after: paragraph.substring(searchMatch.endIndex),
                };
              }),
          };
        },
      ),
    );
  };
}

export function getAccumulatedSearchResults(
  searchTerm: string,
  bookText: string,
): Observable<SearchResults> {
  const paragraphs = bookText.split('\n\n');
  return getSearchResults(searchTerm, paragraphs).pipe(
    accumulateResults(paragraphs.length),
  );
}

export interface WorkerInput {
  url: string;
  searchTerm: string;
}