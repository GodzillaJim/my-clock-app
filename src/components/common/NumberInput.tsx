import React, { ChangeEvent, useState } from "react";
import {
  TextField,
  IconButton,
  Box,
  styled,
  FormControl,
  InputLabel,
  Input,
  OutlinedInput,
  InputAdornment,
} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { fontGrid } from "@mui/material/styles/cssUtils";
import { BorderColor, BorderRight } from "@mui/icons-material";

// Custom styled components
const StyledBox = styled(Box)(({ theme }) => ({
  position: "relative",
  width: "110px",
  "& .MuiInputBase-root": {
    paddingRight: "30px",
  },
  "& .MuiOutlinedInput-input": {
    textAlign: "center",
    padding: "8px",
    fontSize: "24px",
    fontWeight: 500,
  },
}));

const ArrowButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  right: 0,
  padding: 4,
  "&:hover": {
    backgroundColor: "transparent",
  },
  "& .MuiSvgIcon-root": {
    fontSize: "20px",
    color: theme.palette.text.secondary,
  },
}));

const UpArrow = styled(ArrowButton)({
  top: 0,
});

const DownArrow = styled(ArrowButton)({
  bottom: 0,
});

const CustomInputLabel = styled(InputLabel)(({ theme }) => ({
  top: "65px",
  left: "15%",
}));

const CustomIconButton = styled(IconButton)(({ theme }) => ({
  padding: 0,
  pr: 0.25,
  borderRadius: "25%",
  height: "25px",
  "&:hover": {
    outline: "none",
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.getContrastText(theme.palette.primary.main),
  },
  "&:focus-visible": {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.getContrastText(theme.palette.primary.main),
    outline: "none",
  },
  "&:active": {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.getContrastText(theme.palette.primary.main),
    outline: "none",
  },
  "&:focus": {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.getContrastText(theme.palette.primary.main),
    outline: "none",
  },
}));

type NumberInputProps = {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
};

const NumberInput = ({
  value = 240,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label = "mins",
}: NumberInputProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(event.target.value, 10) || 0;
    if (newValue >= min && newValue <= max) {
      onChange?.(newValue);
    }
  };

  const handleIncrement = () => {
    const newValue = value + step;
    if (newValue <= max) {
      onChange?.(newValue);
    }
  };

  const handleDecrement = () => {
    const newValue = value - step;
    if (newValue >= min) {
      onChange?.(newValue);
    }
  };

  return (
    <Box sx={{ textAlign: "center" }}>
      <FormControl>
        <OutlinedInput
          type="number"
          id="number-input"
          value={value}
          onChange={handleChange}
          inputProps={{
            min,
            max,
            sx: {
              textAlign: "center",
              p: 0,
              my: 3,
              "&::-webkit-inner-spin-button, &::-webkit-outer-spin-button": {
                display: "none",
              },
              fontSize: "28px",
            },
          }}
          endAdornment={
            <InputAdornment position="end">
              <Box
                display={"flex"}
                flexDirection={"column"}
                gap={3}
                sx={{ pr: 1, justifyContent: "space-between" }}
              >
                <CustomIconButton onClick={handleIncrement}>
                  <KeyboardArrowUpIcon />
                </CustomIconButton>
                <CustomIconButton onClick={handleDecrement}>
                  <KeyboardArrowDownIcon />
                </CustomIconButton>
              </Box>
            </InputAdornment>
          }
        />
        <CustomInputLabel variant="outlined" htmlFor="number-input">
          {label}
        </CustomInputLabel>
      </FormControl>
    </Box>
  );
};

export default NumberInput;
