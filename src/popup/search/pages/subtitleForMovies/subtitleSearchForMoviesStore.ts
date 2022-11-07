import { defineStore } from 'pinia';
import { from, merge, Subject } from 'rxjs';
import { useStore as useAppStore } from '@/app/store';
import { useStore as useSubtitleStore } from '@/subtitle/store';
import { useStore as useTrackStore } from '@/track/store';
import { useStore as useSearchStore } from '@/search/store';
import { useStore as useLanguageStore } from '@/language/store';
import { useStore as useDownloadStore } from '@/download/store';
import { SubtitleSearchResultData } from '@/search/__gen_gql';
import { switchMap, takeUntil, tap } from 'rxjs/operators';
import {
  searchQuery,
  SubtitleSearchForMoviesQuery,
  SubtitleSearchForMoviesQueryVariables
} from '@/search/pages/subtitleForMovies/searchQuery';
import { computed, ref } from 'vue';

export const useStore = defineStore('subtitleSearchForMoviesStore', () => {
  const unmountSubject = new Subject<undefined>();
  const searchQuerySubject = new Subject<SubtitleSearchForMoviesQueryVariables>();
  const loading = ref(true);
  const tmdb_id = ref('');
  const language = ref(useLanguageStore().preferredContentLanguage);
  const filter = ref('');
  const onlyHearingImpaired = ref(false);
  const entries = ref<Omit<SubtitleSearchResultData, "id" | "type">[]>([]);

  const searchQueryObservable = searchQuerySubject.pipe(
    tap(() => (loading.value = true)),
    switchMap((variables: SubtitleSearchForMoviesQueryVariables) => from(searchQuery(variables))),
    tap((result: SubtitleSearchForMoviesQuery) => {
      loading.value = false;
      entries.value = result.subtitleSearch.data;
    })
  );
  const allObservables = merge(
    unmountSubject,
    searchQueryObservable,
    searchQuerySubject
  ).pipe(takeUntil(unmountSubject));

  return {
    loading,
    tmdb_id,
    language,
    filter,
    onlyHearingImpaired,
    entries,
    initialize() {
      allObservables.subscribe();
    },
    unmount() {
      unmountSubject.next(undefined);
    },
    triggerQuery() {
      searchQuerySubject.next({
        language: language.value.language_code,
        tmdb_id: tmdb_id.value
      });
    },
    async select(openSubtitle: SubtitleSearchResultData, whileDownloadingFn: () => unknown) {
      const appStore = useAppStore();
      const searchStore = useSearchStore();
      const languageStore = useLanguageStore();
      const subtitleStore = useSubtitleStore();
      const trackStore = useTrackStore();
      const downloadStore = useDownloadStore();

      appStore.$patch({ state: 'SELECTED', src: 'SEARCH' });
      await languageStore.setPreferredContentLanguage(this.language);
      searchStore.selectOpenSubtitle({
        format: openSubtitle.attributes.format ?? 'srt',
        languageName: openSubtitle.attributes.language,
        rating: openSubtitle.attributes.ratings.toString(),
        websiteLink: openSubtitle.attributes.url
      });

      whileDownloadingFn();
      const { raw, format } = await downloadStore.download(openSubtitle);

      try {
        subtitleStore.setRaw({
          raw,
          format,
          id: openSubtitle.attributes.files[0].file_name ?? '-',
          language: this.language.iso639_2
        });
        subtitleStore.parse();
      } catch (e) {
        appStore.$patch({ state: 'ERROR' });
      }
      await trackStore.track({ source: 'search-for-movie', language: this.language.language_code });
    },
    contentLanguages: computed(() => useLanguageStore().contentLanguages),
    filteredEntries: computed(() => {
      return entries.value.filter(({ attributes }) => {
        if (filter.value === '') {
          return onlyHearingImpaired.value ? attributes.hearing_impaired : true;
        }
        const intermediate = attributes.files[0].file_name?.toLowerCase().includes(filter.value.toLowerCase()) ?? false;
        return onlyHearingImpaired.value ? intermediate && attributes.hearing_impaired : intermediate;
      });
    })
  };
});