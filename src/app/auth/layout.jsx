'use client'

import { Fragment, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useAuthEmailValidate,
  useEncryptToken,
  useSaveToken,
  useValidation,
  usePasswordAuthentication,
} from '../store/hook/SpcAuth';
import { IS_DEMO } from '../../mocks/install';

const STATIC_AES_KEY = "F0ktvD6Ch/o2CycWs9P15jj2P0tYMgRjR2B4YOgPpv0=";
const SPC_REDIRECT_URL = "https://spl-spc02.shimano.com.sg/SPC_Portal/login";

// AUTH BYPASS: the production auth is SPC-Portal SSO, which is not reachable on a
// developer machine or on the standalone dummy-data build. We skip the redirect
// when running on localhost OR when the app is in dummy-data mode (IS_DEMO, the
// single source of truth from mocks/install.js — driven by REACT_APP_LIVE_DATA).
// Set REACT_APP_LIVE_DATA=true to restore SSO against the real API.
const IS_LOCAL_DEV =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const BYPASS_AUTH = IS_LOCAL_DEV || IS_DEMO;

const redirectToSpc = () => {
  localStorage.removeItem("accessToken");
  window.location.href = SPC_REDIRECT_URL;
};

const ValidationInterval = () => {
  const { mutate: Validation } = useValidation();
  useEffect(() => {
    if (BYPASS_AUTH) return; // skip periodic SPC validation locally / in demo
    const CheckValidationAPI = () => {
      const token = localStorage?.getItem("accessToken");
      if (!token) {
        redirectToSpc();
        return;
      }
      Validation(
        { Token: token },
        {
          onSuccess: (data) => {
            if (!(data?.statusCode === 200 && data?.data === true)) {
              redirectToSpc();
            }
          },
          onError: () => redirectToSpc(),
        }
      );
    };
    const intervalId = setInterval(() => CheckValidationAPI(), 30000);
    return () => clearInterval(intervalId);
  }, [Validation]);
  return null;
};

const AuthLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const authCode = searchParams.get('auth_code');
  const emailParam = searchParams.get('email');

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const hasRunRef = useRef(false);

  const authEmailValidate = useAuthEmailValidate();
  const encryptToken = useEncryptToken();
  const saveToken = useSaveToken();
  const passwordAuth = usePasswordAuthentication();
  const { mutate: Validation } = useValidation();

  const validateToken = (token) => {
    Validation(
      { Token: token },
      {
        onSuccess: (resp) => {
          if (resp?.statusCode === 200 && resp?.data === true) {
            setIsAuthenticated(true);
            setIsChecking(false);
          } else {
            redirectToSpc();
          }
        },
        onError: () => redirectToSpc(),
      }
    );
  };

  const runAuthCodeFlow = (code) => {
    passwordAuth.mutateAsync(
      { token: code },
      {
        onSuccess: (resp) => {
          if (resp?.status === "true" && resp?.token) {
            const jwt = resp.token;
            localStorage.setItem('accessToken', jwt);
            if (resp?.customerEmail) {
              localStorage.setItem('userEmail', resp.customerEmail);
            }
            if (resp?.role) {
              localStorage.setItem('userRole', resp.role);
            }
            if (resp?.departmentList) {
              localStorage.setItem(
                'departmentList',
                Array.isArray(resp.departmentList)
                  ? resp.departmentList.join(',')
                  : String(resp.departmentList)
              );
            }
            navigate('/', { replace: true });
            validateToken(jwt);
          } else {
            redirectToSpc();
          }
        },
        onError: () => redirectToSpc(),
      }
    );
  };

  const runAesHandshakeFlow = (encodedEmail) => {
    const decodedEmail = atob(encodedEmail);
    const payload = {
      email: decodedEmail,
      key: STATIC_AES_KEY,
    };

    encryptToken.mutateAsync(payload, {
      onSuccess: (response) => {
        if (response?.statusCode === 200) {
          const token = response?.data;
          localStorage.setItem('accessToken', token);
          navigate('/', { replace: true });
          validateToken(token);
        } else {
          redirectToSpc();
        }
      },
      onError: () => redirectToSpc(),
    });
  };

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    if (BYPASS_AUTH) {
      // Local dev / demo build: bypass SPC-Portal SSO and render directly.
      setIsAuthenticated(true);
      setIsChecking(false);
      return;
    }

    if (authCode) {
      runAuthCodeFlow(authCode);
    } else if (emailParam) {
      runAesHandshakeFlow(emailParam);
    } else {
      const token = localStorage.getItem('accessToken');
      if (token) {
        validateToken(token);
      } else {
        redirectToSpc();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isChecking || !isAuthenticated) {
    return null;
  }

  return (
    <Fragment>
      <div className="auth-layout">
        <ValidationInterval />
        {children}
      </div>
    </Fragment>
  );
};

export default AuthLayout;
