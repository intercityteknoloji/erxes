import client from 'apolloClient';
import { getEnv } from 'apolloClient';
import gql from 'graphql-tag';
import { __, Alert, uploadHandler, withProps } from 'modules/common/utils';
import { KIND_CHOICES } from 'modules/settings/integrations/constants';
import * as React from 'react';
import { compose, graphql } from 'react-apollo';
import { withRouter } from 'react-router';
import { Bulk } from '../../common/components';
import { IRouterProps } from '../../common/types';
import { ListConfigQueryResponse } from '../../companies/types';
import { CustomersList } from '../components';
import { mutations, queries } from '../graphql';
import {
  ListQueryVariables,
  MainQueryResponse,
  MergeMutationResponse,
  MergeMutationVariables,
  RemoveMutationResponse,
  RemoveMutationVariables
} from '../types';

type Props = {
  queryParams: any;
};

type FinalProps = {
  customersMainQuery: MainQueryResponse;
  customersListConfigQuery: ListConfigQueryResponse;
} & Props &
  RemoveMutationResponse &
  MergeMutationResponse &
  IRouterProps;

type State = {
  loading: boolean;
};

class CustomerListContainer extends React.Component<FinalProps, State> {
  constructor(props) {
    super(props);

    this.state = {
      loading: false
    };
  }

  render() {
    const {
      customersMainQuery,
      customersListConfigQuery,
      customersRemove,
      customersMerge,
      history
    } = this.props;

    let columnsConfig =
      customersListConfigQuery.fieldsDefaultColumnsConfig || [];

    // load config from local storage
    const localConfig = localStorage.getItem('erxes_customer_columns_config');

    if (localConfig) {
      columnsConfig = JSON.parse(localConfig);
    }

    const removeCustomers = ({ customerIds }, emptyBulk) => {
      customersRemove({
        variables: { customerIds }
      })
        .then(() => {
          emptyBulk();
          Alert.success('Success');
        })
        .catch(e => {
          Alert.error(e.message);
        });
    };

    const mergeCustomers = ({ ids, data, callback }) =>
      customersMerge({
        variables: {
          customerIds: ids,
          customerFields: data
        }
      })
        .then((result: any) => {
          callback();
          Alert.success('Success');
          history.push(`/customers/details/${result.data.customersMerge._id}`);
        })
        .catch(e => {
          Alert.error(e.message);
        });

    const exportCustomers = bulk => {
      const { queryParams } = this.props;

      if (bulk.length > 0) {
        queryParams.ids = bulk.map(customer => customer._id);
      }

      this.setState({ loading: true });

      client
        .query({
          query: gql(queries.customersExport),
          variables: { ...queryParams }
        })
        .then(({ data }: any) => {
          this.setState({ loading: false });
          window.open(data.customersExport, '_blank');
        })
        .catch(error => {
          Alert.error(error.message);
        });
    };

    const handleXlsUpload = e => {
      const xlsFile = e.target.files;

      const { REACT_APP_API_URL } = getEnv();

      uploadHandler({
        files: xlsFile,
        extraFormData: [{ key: 'type', value: 'customers' }],
        url: `${REACT_APP_API_URL}/import-file`,
        responseType: 'json',
        beforeUpload: () => {
          this.setState({ loading: true });
        },

        afterUpload: ({ response }) => {
          if (response.length === 0) {
            customersMainQuery.refetch();
            Alert.success(__('All customers imported successfully'));
          } else {
            Alert.error(response[0]);
          }

          this.setState({ loading: false });
        }
      });

      e.target.value = null;
    };

    const searchValue = this.props.queryParams.searchValue || '';

    const { list = [], totalCount = 0 } =
      customersMainQuery.customersMain || {};

    const updatedProps = {
      ...this.props,
      columnsConfig,
      customers: list,
      totalCount,
      exportCustomers,
      handleXlsUpload,
      integrations: KIND_CHOICES.ALL_LIST,
      searchValue,
      loading: customersMainQuery.loading || this.state.loading,
      mergeCustomers,
      removeCustomers
    };

    const content = props => {
      return <CustomersList {...updatedProps} {...props} />;
    };

    const refetch = () => {
      this.props.customersMainQuery.refetch();
    };

    return <Bulk content={content} refetch={refetch} />;
  }
}

const generateParams = ({ queryParams }) => {
  return {
    page: queryParams.page,
    perPage: queryParams.perPage || 20,
    segment: queryParams.segment,
    tag: queryParams.tag,
    ids: queryParams.ids,
    searchValue: queryParams.searchValue,
    brand: queryParams.brand,
    integration: queryParams.integrationType,
    form: queryParams.form,
    startDate: queryParams.startDate,
    endDate: queryParams.endDate,
    leadStatus: queryParams.leadStatus,
    lifecycleState: queryParams.lifecycleState,
    sortField: queryParams.sortField,
    sortDirection: queryParams.sortDirection
  };
};

export default withProps<Props>(
  compose(
    graphql<Props, MainQueryResponse, ListQueryVariables>(
      gql(queries.customersMain),
      {
        name: 'customersMainQuery',
        options: ({ queryParams }) => ({
          variables: generateParams({ queryParams }),
          fetchPolicy: 'network-only'
        })
      }
    ),
    graphql<Props, ListConfigQueryResponse, {}>(
      gql(queries.customersListConfig),
      {
        name: 'customersListConfigQuery',
        options: () => ({
          fetchPolicy: 'network-only'
        })
      }
    ),

    // mutations
    graphql<Props, RemoveMutationResponse, RemoveMutationVariables>(
      gql(mutations.customersRemove),
      {
        name: 'customersRemove'
      }
    ),
    graphql<Props, MergeMutationResponse, MergeMutationVariables>(
      gql(mutations.customersMerge),
      {
        name: 'customersMerge',
        options: {
          refetchQueries: ['customersMain', 'customerCounts']
        }
      }
    )
  )(withRouter<IRouterProps>(CustomerListContainer))
);
